// lib/agent/orchestrator.ts
import { AgentContext, RetryContext } from '../types';
import { eventBus } from '../bus';
import { frameTask } from './frame';
import { selectRegion } from './select-region';
import { draftCode } from './draft-code';
import { executeCode } from './exec-code';
import { reflect } from './reflect';
import { respond } from './respond';
import { calculateHighlightRanges } from './calculate-ranges';

export async function runAgentPipeline(context: AgentContext) {
  const { sessionId } = context;
  console.log('Starting agent pipeline for session:', sessionId);
  
  context.maxRetries = 5;
  
  try {
    // Stage 1: Frame the task
    console.log('Stage 1: Framing task...');
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: '🤔 Understanding your request...' 
    });
    
    const frame = await frameTask(context);
    console.log('Frame result:', frame);
    
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `📋 Task identified: ${frame.intent}` 
    });
    
    // Stage 2: Select region
    console.log('Stage 2: Selecting region...');
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `🔍 Analyzing sheet: ${frame.targetSheet || 'default'}` 
    });
    
    const region = selectRegion(frame, context.sheetModel);
    console.log('Selected region:', { sheetId: region.sheetId, range: region.range });
    
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `📊 Working with ${region.data.length} rows of data` 
    });
    
    let retryCount = 0;
    let execResult;
    let code;
    const retryContext: RetryContext = {
      previousAttempts: [],
      failureReason: '',
      gptFeedback: undefined
    };
    
    do {
      // Stage 3: Draft code
      console.log(`Stage 3: Drafting code (attempt ${retryCount + 1})...`);
      
      if (retryCount === 0) {
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: '💻 Writing JavaScript analysis code...' 
        });
      } else {
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: `🔄 Retry ${retryCount}/${context.maxRetries}: ${retryContext.failureReason}` 
        });
      }
      
      code = await draftCode(
        frame, 
        region, 
        context, 
        retryCount > 0 ? retryContext : undefined
      );
      
      // Stage 4: Execute
      console.log('Stage 4: Executing code...');
      eventBus.publish(sessionId, { 
        type: 'thought', 
        message: '⚡ Running data analysis...' 
      });
      
      execResult = await executeCode(code, region);
      console.log('Execution result:', { ok: execResult.ok, error: execResult.error });
      
      // Stage 5: Dynamic highlighting
      if (execResult.dataAccess && execResult.dataAccess.accessedCells.length > 0) {
        const highlightRanges = calculateHighlightRanges(
          execResult.dataAccess,
          region.sheetId
        );
        
        // Send highlight events
        highlightRanges.forEach(highlight => {
          console.log(`Highlighting: ${highlight.description} - ${highlight.range}`);
          eventBus.publish(sessionId, { 
            type: 'highlight', 
            sheetId: highlight.sheetId, 
            range: highlight.range 
          });
        });
        
        const rowCount = execResult.dataAccess.accessedRows.size;
        const colCount = execResult.dataAccess.accessedColumns.size;
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: `🎯 Analyzed ${rowCount} rows × ${colCount} columns` 
        });
      }
      
      // Log execution details
      if (execResult.stdout) {
        const stdoutLines = execResult.stdout.trim().split('\n');
        stdoutLines.forEach(line => {
          eventBus.publish(sessionId, { 
            type: 'thought', 
            message: `📝 Console: ${line}` 
          });
        });
      }
      
      // Stage 6: Reflect
      if (!execResult.ok) {
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: `❌ JavaScript error: ${execResult.error}` 
        });
      } else if (execResult.result) {
        const resultPreview = JSON.stringify(execResult.result).slice(0, 100);
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: `✅ Got result: ${resultPreview}${resultPreview.length >= 100 ? '...' : ''}` 
        });
      }
      
      console.log('Stage 6: Reflecting on result...');
      const reflection = await reflect(frame, execResult, context);
      console.log('Reflection result:', reflection);
      
      if (reflection.decision === 'done') {
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: '🎯 Result looks good! Formatting response...' 
        });
        break;
      }
      
      // Prepare retry context
      retryContext.previousAttempts.push({
        code,
        error: execResult.error,
        result: execResult.result,
        stdout: execResult.stdout
      });
      retryContext.failureReason = reflection.failureReason || 'unknown';
      retryContext.gptFeedback = reflection.feedback;
      
      retryCount++;
      
      if (retryCount >= context.maxRetries) {
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: `⚠️ Reached maximum retries (${context.maxRetries}). Using best result...` 
        });
      }
      
    } while (retryCount < context.maxRetries && context.gptCallCount < context.maxGptCalls);
    
    // Stage 7: Respond
    console.log('Stage 7: Generating response...');
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: '📊 Formatting results...' 
    });
    
    const answer = await respond(frame, execResult!, context);
    console.log('Answer generated');
    
    // Send final answer
    eventBus.publish(sessionId, { 
      type: 'answer', 
      content: answer 
    });
    
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `✨ Analysis complete! (${retryCount > 0 ? `Took ${retryCount + 1} attempts` : 'First try!'})` 
    });
    
    console.log('Agent pipeline completed successfully');
    
  } catch (error) {
    console.error('Agent pipeline error:', error);
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
    
    eventBus.publish(sessionId, { 
      type: 'answer', 
      content: {
        markdown: `I encountered an error while analyzing your data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: null
      }
    });
  }
}