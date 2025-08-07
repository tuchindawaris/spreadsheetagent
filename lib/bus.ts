import { AgentEvent } from './types';

type Subscriber = (event: AgentEvent) => void;

// Use a global Map that persists across all module loads
declare global {
  var sseSubscribers: Map<string, Set<Subscriber>> | undefined;
}

// Initialize the global map if it doesn't exist
if (!globalThis.sseSubscribers) {
  globalThis.sseSubscribers = new Map();
  console.log('EventBus: Initialized global subscribers map');
}

class EventBus {
  // Use the global map directly
  private get subscribers() {
    return globalThis.sseSubscribers!;
  }

  subscribe(sessionId: string, callback: Subscriber) {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(callback);
    
    console.log(`EventBus: New subscriber for session ${sessionId}. Total subscribers: ${this.subscribers.get(sessionId)!.size}`);
    console.log(`EventBus: Total sessions: ${this.subscribers.size}`);

    return () => {
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.delete(callback);
        console.log(`EventBus: Unsubscribed from session ${sessionId}. Remaining subscribers: ${subs.size}`);
        if (subs.size === 0) {
          this.subscribers.delete(sessionId);
          console.log(`EventBus: Removed session ${sessionId}. Remaining sessions: ${this.subscribers.size}`);
        }
      }
    };
  }

  publish(sessionId: string, event: AgentEvent) {
    // Log all events for debugging
    console.log('EventBus: Publishing event:', { 
      sessionId, 
      type: event.type, 
      subscriberCount: this.subscribers.get(sessionId)?.size || 0,
      totalSessions: this.subscribers.size
    });
    
    const subs = this.subscribers.get(sessionId);
    if (subs && subs.size > 0) {
      console.log(`EventBus: Found ${subs.size} subscribers for session ${sessionId}`);
      subs.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('EventBus: Error in subscriber callback:', error);
        }
      });
    } else {
      console.warn(`EventBus: No subscribers for session ${sessionId}`);
      console.log('EventBus: Available sessions:', Array.from(this.subscribers.keys()));
    }
  }

  clear(sessionId: string) {
    console.log(`EventBus: Clearing all subscribers for session ${sessionId}`);
    this.subscribers.delete(sessionId);
  }

  getSubscriberCount(sessionId: string): number {
    const count = this.subscribers.get(sessionId)?.size || 0;
    console.log(`EventBus: Subscriber count for ${sessionId}: ${count}`);
    return count;
  }

  hasSubscribers(sessionId: string): boolean {
    return this.getSubscriberCount(sessionId) > 0;
  }

  // Debug method to list all sessions
  debugSessions() {
    console.log('EventBus: Active sessions:', {
      sessions: Array.from(this.subscribers.entries()).map(([id, subs]) => ({
        sessionId: id,
        subscriberCount: subs.size
      }))
    });
  }
}

// Export a single instance
export const eventBus = new EventBus();