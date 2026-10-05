type DurableObjectStateLike = {
  acceptWebSocket(webSocket: WebSocket): void;
  getWebSockets(): WebSocket[];
};

type RealtimeMessage = {
  type: "change";
  resources: string[];
  path: string;
  method: string;
  sourceClientId?: string;
  at: number;
};

/**
 * Hub único de eventos em tempo real. O estado não precisa ser persistido:
 * conexões WebSocket são mantidas pelo Durable Object e hibernam quando ociosas.
 */
export class RadasaRealtimeHub {
  constructor(private readonly state: DurableObjectStateLike) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/broadcast" && request.method === "POST") {
      let payload: RealtimeMessage;
      try {
        payload = await request.json() as RealtimeMessage;
      } catch {
        return new Response("Payload inválido.", { status: 400 });
      }

      const message = JSON.stringify(payload);
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(message);
        } catch {
          try { socket.close(1011, "Falha ao sincronizar."); } catch { /* noop */ }
        }
      }
      return new Response(null, { status: 204 });
    }

    const upgrade = String(request.headers.get("Upgrade") || "").toLowerCase();
    if (upgrade !== "websocket") {
      return new Response("WebSocket obrigatório.", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "radasa-sync" },
    } as ResponseInit & { webSocket: WebSocket });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === "string" && message === "ping") {
      try { socket.send("pong"); } catch { /* noop */ }
    }
  }

  webSocketClose(_socket: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // O runtime remove automaticamente a conexão da lista do Durable Object.
  }

  webSocketError(socket: WebSocket) {
    try { socket.close(1011, "Erro de conexão."); } catch { /* noop */ }
  }
}
