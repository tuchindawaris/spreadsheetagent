import OpenAI from 'openai';
import { Frame, AgentContext, ReflectionResult, FailureReason, ExecResultWithAccess } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper to check if all values in array are null/undefined
function allNulls(arr: any[]): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.every(item => item === null || item === undefined);
}

// Helper to check if all values are whitespace/empty strings
function allWhitespace(arr: any[]): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.every(item => {
    if (typeof item !== 'string') return false;
    return item.trim() === '';
  });
}

// Helper to check if result has no variance (all same value)
function noVariance(arr: any[]): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const first = JSON.stringify(arr[0]);
  return arr.every(item => JSON.stringify(item) === first);
}

export async function reflect(
  frame: Frame,
  execResult: ExecResultWithAccess,
  context: AgentContext
): Promise<ReflectionResult> {
  const { gptCallCount, maxGptCalls } = context;
  
  // Always retry on execution error
  if (!execResult.ok) {
    return {
      decision: 'retry',
      failureReason: 'execution_error',
      feedback: execResult.error || 'Code execution failed'
    };
  }
  
  // Check for common failure patterns
  const result = execResult.result;
  
  // Check for empty/null results
  if (result === null || result === undefined) {
    return {
      decision: 'retry',
      failureReason: 'empty_result',
      feedback: 'Result is null or undefined'
    };
  }
  
  // For array results, check data quality
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return {
        decision: 'retry',
        failureReason: 'empty_result',
        feedback: 'Result is an empty array'
      };
    }
    
    if (allNulls(result)) {
      return {
        decision: 'retry',
        failureReason: 'all_nulls',
        feedback: 'All values in result are null/undefined - likely accessing wrong column'
      };
    }
    
    if (allWhitespace(result)) {
      return {
        decision: 'retry',
        failureReason: 'all_whitespace',
        feedback: 'All values are empty strings or whitespace - likely wrong column or data parsing issue'
      };
    }
    
    if (result.length > 1 && noVariance(result)) {
      return {
        decision: 'retry',
        failureReason: 'no_variance',
        feedback: 'All values are identical - might be accessing wrong data or calculation error'
      };
    }
  }
  
  // Force completion if at GPT call limit
  if (gptCallCount >= maxGptCalls) {
    return { decision: 'done' };
  }
  
  // Use GPT to evaluate if result answers the user's question
  const systemPrompt = `You are evaluating JavaScript code execution results for spreadsheet data analysis.
Given the user's intent and the execution result, determine if the result satisfactorily answers the user's question.

Respond with a JSON object containing:
- decision: "done" if the result answers the question, "retry" if it needs improvement
- failureReason: if retry, one of: "irrelevant_result", "missing_data", "type_mismatch" 
- feedback: if retry, explain specifically what's wrong and what should be fixed

Be strict - if the result doesn't directly answer what the user asked for, request a retry.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `User Intent: ${frame.intent}
Summary: ${frame.summary}
Stdout: ${execResult.stdout}
Result Type: ${Array.isArray(execResult.result) ? 'array' : typeof execResult.result}
Result Sample: ${JSON.stringify(execResult.result).slice(0, 1000)}` 
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 200
  });
  
  context.gptCallCount++;
  
  const evaluation = JSON.parse(response.choices[0].message.content!);
  
  return {
    decision: evaluation.decision || 'done',
    failureReason: evaluation.failureReason as FailureReason,
    feedback: evaluation.feedback
  };
}