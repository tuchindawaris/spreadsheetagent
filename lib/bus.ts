import { AgentEvent } from './types';

type Subscriber = (event: AgentEvent) => void;

class EventBus {
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(sessionId: string, callback: Subscriber) {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(callback);

    return () => {
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(sessionId);
        }
      }
    };
  }

  publish(sessionId: string, event: AgentEvent) {
    // Only log errors and answers, not every event
    if (event.type === 'answer' || (event.type === 'thought' && event.message.includes('Error'))) {
      console.log('Publishing event:', { sessionId, event });
    }
    
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.forEach(callback => callback(event));
    }
  }

  clear(sessionId: string) {
    this.subscribers.delete(sessionId);
  }
}

export const eventBus = new EventBus();