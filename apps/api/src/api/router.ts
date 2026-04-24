/**
 * API Router — URL pattern matching and request dispatch.
 *
 * Uses Bun's native URLPattern for efficient routing.
 * All routes are prefixed with /api/v1.
 */

import { AppError, Errors } from "../lib/errors";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RouteHandler = (
  req: Request,
  params: Record<string, string>
) => Promise<Response>;

interface Route {
  method: Method;
  pattern: URLPattern;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  private add(method: Method, path: string, handler: RouteHandler): void {
    const pattern = new URLPattern({ pathname: `/api/v1${path}` });
    this.routes.push({ method, pattern, handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.add("PATCH", path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.add("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.add("DELETE", path, handler);
  }

  async handle(req: Request): Promise<Response | null> {
    const method = req.method as Method;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = route.pattern.exec(req.url);
      if (!match) continue;

      const params = match.pathname.groups as Record<string, string>;

      try {
        return await route.handler(req, params);
      } catch (err) {
        if (err instanceof AppError) {
          return err.toResponse();
        }
        const e = err as Error;
        console.error(`[router] Unhandled error on ${method} ${req.url}:`, e.message);
        console.error("[router] Stack:", e.stack);
        return Response.json(
          { error: { code: "INTERNAL_ERROR", message: e.message ?? "Internal server error" } },
          { status: 500 }
        );
      }
    }

    return null; // No match
  }
}
