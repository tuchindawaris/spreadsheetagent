import { AgentContext } from '../types';
import { eventBus } from '../bus';
import { frameTask } from './frame';
import { selectRegion } from './select-region';
import { draftCode } from './draft-code';
import { executeCode } from './exec-code';
import { reflect } from './reflect';
import { respond } from './respond';

export async function runAgentPipeline(context: AgentContext) {
  const { sessionId } = context;
  console.log('Starting agent pipeline for session:', sessionId);
  
  // Log subscriber count at start
  console.log(`Pipeline starting with ${eventBus.getSubscriberCount(sessionId)} subscribers`);
  
  try {
    // Stage 1: Frame the task
    console.log('Stage 1: Framing task...');
    console.log(`Publishing thought event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: 'Understanding your request...' 
    });
    const frame = await frameTask(context);
    console.log('Frame result:', frame);
    
    // Stage 2: Select region
    console.log('Stage 2: Selecting region...');
    console.log(`Publishing thought event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `Looking for data in columns: ${frame.neededColumns.join(', ')}` 
    });
    const region = selectRegion(frame, context.sheetModel);
    console.log('Selected region:', { sheetId: region.sheetId, range: region.range });
    
    // Stage 3: Highlight cells
    console.log('Stage 3: Highlighting cells...');
    console.log(`Publishing highlight event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
    eventBus.publish(sessionId, { 
      type: 'highlight', 
      sheetId: region.sheetId, 
      range: region.range 
    });
    
    let retryCount = 0;
    let execResult;
    let code;
    
    do {
      // Stage 4: Draft code
      console.log(`Stage 4: Drafting code (attempt ${retryCount + 1})...`);
      console.log(`Publishing thought event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
      eventBus.publish(sessionId, { 
        type: 'thought', 
        message: retryCount === 0 ? 'Writing JavaScript analysis code...' : 'Refining analysis code...' 
      });
      code = await draftCode(frame, region, context);
      
      // Stage 5: Execute
      console.log('Stage 5: Executing code...');
      console.log(`Publishing thought event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
      eventBus.publish(sessionId, { 
        type: 'thought', 
        message: 'Running data analysis...' 
      });
      execResult = await executeCode(code, region);
      console.log('Execution result:', { ok: execResult.ok, error: execResult.error });
      
      // Stage 6: Reflect
      if (!execResult.ok) {
        console.log(`Publishing error thought (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
        eventBus.publish(sessionId, { 
          type: 'thought', 
          message: `JavaScript error: ${execResult.error}. Retrying...` 
        });
      }
      
      console.log('Stage 6: Reflecting on result...');
      const decision = await reflect(frame, execResult, context);
      console.log('Reflection decision:', decision);
      
      if (decision === 'done') break;
      
      retryCount++;
      console.log(`Retry count: ${retryCount}/${context.maxRetries}`);
    } while (retryCount < context.maxRetries && context.gptCallCount < context.maxGptCalls);
    
    // Stage 7: Respond
    console.log('Stage 7: Generating response...');
    console.log(`Publishing thought event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: 'Formatting results...' 
    });
    const answer = await respond(frame, execResult!, context);
    console.log('Answer generated:', { hasMarkdown: !!answer.markdown, hasTable: !!answer.tableJson });
    
    // Send final answer
    console.log(`Publishing answer event (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
    eventBus.publish(sessionId, { 
      type: 'answer', 
      content: answer 
    });
    
    console.log('Agent pipeline completed successfully');
    console.log(`Final subscriber count: ${eventBus.getSubscriberCount(sessionId)}`);
    
  } catch (error) {
    console.error('Agent pipeline error:', error);
    console.log(`Publishing error events (subscribers: ${eventBus.getSubscriberCount(sessionId)})`);
    eventBus.publish(sessionId, { 
      type: 'thought', 
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
    
    eventBus.publish(sessionId, { 
      type: 'answer', 
      content: {
        markdown: `I encountered an error while analyzing your data: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }
}