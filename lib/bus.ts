import { AgentEvent } from './types';

type Subscriber = (event: AgentEvent) => void;

class EventBus {
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(sessionId: string, callback: Subscriber) {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(callback);
    
    console.log(`EventBus: New subscriber for session ${sessionId}. Total subscribers: ${this.subscribers.get(sessionId)!.size}`);

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
    // Log all events for debugging
    console.log('EventBus: Publishing event:', { sessionId, type: event.type, subscriberCount: this.subscribers.get(sessionId)?.size || 0 });
    
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('EventBus: Error in subscriber callback:', error);
        }
      });
    } else {
      console.warn(`EventBus: No subscribers for session ${sessionId}`);
    }
  }

  clear(sessionId: string) {
    console.log(`EventBus: Clearing all subscribers for session ${sessionId}`);
    this.subscribers.delete(sessionId);
  }

  getSubscriberCount(sessionId: string): number {
    return this.subscribers.get(sessionId)?.size || 0;
  }

  hasSubscribers(sessionId: string): boolean {
    return this.getSubscriberCount(sessionId) > 0;
  }
}

export const eventBus = new EventBus();