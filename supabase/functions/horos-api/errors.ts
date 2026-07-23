export class ResponseError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details: Record<string, unknown> = {},
    public headers: HeadersInit = {},
  ) {
    super(message);
    this.name = "ResponseError";
  }
}
