/**
 * Response helpers — consistent JSON envelope.
 */

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function created<T>(data: T): Response {
  return ok(data, 201);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function paginated<T>(
  data: T[],
  opts: { total: number; page: number; pageSize: number }
): Response {
  return Response.json({
    data,
    pagination: {
      total: opts.total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(opts.total / opts.pageSize),
    },
  });
}
