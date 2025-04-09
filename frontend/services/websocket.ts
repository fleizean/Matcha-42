// frontend/services/websocket.ts

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandlers: MessageHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: ConnectionHandler[] = [];
  private errorHandlers: ((error: Event) => void)[] = [];
  private initializing: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private activeConversationId: string | null = null; // Track active conversation

  // Create a singleton instance
  private static instance: WebSocketService | null = null;

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private constructor() {}

  // Set the active conversation ID
  public setActiveConversation(userId: string | null): void {
    this.activeConversationId = userId;
    //console.log(`Active conversation set to: ${userId}`);
  }

  // Get the active conversation ID
  public getActiveConversation(): string | null {
    return this.activeConversationId;
  }

  public connect(apiUrl: string, token: string): void {
    // Don't try to connect if already in the process of initializing
    if (this.initializing) {
      console.log('WebSocket connection already in progress...');
      return;
    }

    // Don't reconnect if already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected');
      return;
    }

    // Don't bother if no API URL or token
    if (!apiUrl || !token) {
      console.error('Missing apiUrl or token for WebSocket connection');
      return;
    }

    this.initializing = true;
    this.token = token;
    this.url = apiUrl;

    try {
      // Use a secure connection if the page is served over HTTPS
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(apiUrl);
      
      // Construct WebSocket URL
      const wsUrl = `${wsProtocol}//${url.host}/api/realtime/ws/${token}`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      // Clean up any existing connection
      this.cleanupConnection();
      
      // Create new WebSocket connection
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.initializing = false;
      
      // Notify error handlers
      this.errorHandlers.forEach(handler => {
        try {
          handler(new Event('error'));
        } catch (err) {
          console.error('Error in error handler:', err);
        }
      });
    }
  }

  public disconnect(): void {
    this.reconnectAttempts = 0;
    this.cleanupConnection();
  }
  
  private cleanupConnection(): void {
    // Close the websocket if it exists
    if (this.ws) {
      // Remove event handlers to prevent potential memory leaks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      // Only try to close if not already closed
      if (this.ws.readyState !== WebSocket.CLOSED && this.ws.readyState !== WebSocket.CLOSING) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Clear all timers
    this.clearTimers();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public send(message: any): void {
    if (!this.isConnected()) {
      console.error('WebSocket is not connected. Cannot send message.');
      return;
    }

    try {
      this.ws?.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  public addMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  public removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  public addConnectHandler(handler: ConnectionHandler): void {
    this.connectHandlers.push(handler);
  }

  public removeConnectHandler(handler: ConnectionHandler): void {
    this.connectHandlers = this.connectHandlers.filter(h => h !== handler);
  }

  public addDisconnectHandler(handler: ConnectionHandler): void {
    this.disconnectHandlers.push(handler);
  }

  public removeDisconnectHandler(handler: ConnectionHandler): void {
    this.disconnectHandlers = this.disconnectHandlers.filter(h => h !== handler);
  }

  public addErrorHandler(handler: (error: Event) => void): void {
    this.errorHandlers.push(handler);
  }

  public removeErrorHandler(handler: (error: Event) => void): void {
    this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
  }

  private handleOpen(): void {
    console.log('WebSocket opened successfully');
    this.initializing = false;
    this.reconnectAttempts = 0;
    
    // Start ping interval to keep connection alive
    this.startPingInterval();
    
    // Notify all connect handlers
    this.connectHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('Error in connect handler:', error);
      }
    });
  }

  private handleClose(event: CloseEvent): void {
    this.initializing = false;
    console.log(`WebSocket disconnected with code: ${event.code}, reason: ${event.reason}`);
    
    // Only try to reconnect for certain close codes
    // 1000 (Normal Closure) and 1001 (Going Away) don't need reconnection
    // 1008 (Policy Violation) likely means auth issues, don't retry
    if (event.code !== 1000 && event.code !== 1001 && event.code !== 1008) {
      this.scheduleReconnect();
    }
    
    // Notify all disconnect handlers
    this.disconnectHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('Error in disconnect handler:', error);
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Handle ping-pong internally
      if (data.type === 'pong') {
        console.log('Ping-pong completed');
        return;
      }
      
      // Filter out message notifications if currently viewing that conversation
      if (data.type === 'notification' && data.data?.type === 'message') {
        // If sender_id matches activeConversationId, don't forward the notification
        if (data.data.sender_id === this.activeConversationId) {
          console.log(`Suppressing notification for active conversation: ${this.activeConversationId}`);
          return;
        }
      }
      
      // Notify all message handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    
    // Notify all error handlers
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    });
  }

  private startPingInterval(): void {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Send a ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Check if we should attempt to reconnect
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }
    
    // Increase reconnect delay with each attempt (exponential backoff)
    const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    // Try to reconnect after calculated delay if we have a URL and token
    // and only if the page is visible
    if (this.url && this.token) {
      this.reconnectTimeout = setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          console.log(`Attempting to reconnect WebSocket (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          this.connect(this.url, this.token);
        }
      }, delay);
    }
  }

  private clearTimers(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export default WebSocketService;