import { AgentEvent } from './types';

type Subscriber = (event: AgentEvent) => void;

class EventBus {
  private subscribers = new Map<string, Set<Subscriber>>();
  private eventBuffer = new Map<string, AgentEvent[]>();
  private bufferTimeout = 10000; // Keep events for 10 seconds

  subscribe(sessionId: string, callback: Subscriber) {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(callback);
    
    console.log(`EventBus: New subscriber for session ${sessionId}. Total subscribers: ${this.subscribers.get(sessionId)!.size}`);

    // Send any buffered events to the new subscriber
    const bufferedEvents = this.eventBuffer.get(sessionId);
    if (bufferedEvents && bufferedEvents.length > 0) {
      console.log(`EventBus: Sending ${bufferedEvents.length} buffered events to new subscriber`);
      bufferedEvents.forEach(event => {
        try {
          callback(event);
        } catch (error) {
          console.error('EventBus: Error sending buffered event:', error);
        }
      });
      // Clear buffer after sending
      this.eventBuffer.delete(sessionId);
    }

    return () => {
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.delete(callback);
        console.log(`EventBus: Unsubscribed from session ${sessionId}. Remaining subscribers: ${subs.size}`);
        if (subs.size === 0) {
          this.subscribers.delete(sessionId);
        }
      }
    };
  }

  publish(sessionId: string, event: AgentEvent) {
    const subs = this.subscribers.get(sessionId);
    const subscriberCount = subs?.size || 0;
    
    console.log('EventBus: Publishing event:', { 
      sessionId, 
      type: event.type, 
      subscriberCount,
      hasSubscribers: subscriberCount > 0 
    });
    
    if (subs && subs.size > 0) {
      // Send to all subscribers
      subs.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('EventBus: Error in subscriber callback:', error);
        }
      });
    } else {
      // No subscribers - buffer the event
      console.warn(`EventBus: No subscribers for session ${sessionId}, buffering event`);
      
      if (!this.eventBuffer.has(sessionId)) {
        this.eventBuffer.set(sessionId, []);
        
        // Set timeout to clear buffer
        setTimeout(() => {
          if (this.eventBuffer.has(sessionId)) {
            console.log(`EventBus: Clearing buffer for session ${sessionId} after timeout`);
            this.eventBuffer.delete(sessionId);
          }
        }, this.bufferTimeout);
      }
      
      this.eventBuffer.get(sessionId)!.push(event);
    }
  }

  clear(sessionId: string) {
    console.log(`EventBus: Clearing all subscribers and buffer for session ${sessionId}`);
    this.subscribers.delete(sessionId);
    this.eventBuffer.delete(sessionId);
  }

  getSubscriberCount(sessionId: string): number {
    return this.subscribers.get(sessionId)?.size || 0;
  }

  hasSubscribers(sessionId: string): boolean {
    return this.getSubscriberCount(sessionId) > 0;
  }
}

export const eventBus = new EventBus();