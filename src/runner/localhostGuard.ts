import dns from "node:dns/promises";

export async function assertLocalhost(baseUrl: string): Promise<void> {
  const hostname = new URL(baseUrl).hostname;

  let address: string;
  try {
    const result = await dns.lookup(hostname);
    address = result.address;
  } catch (err) {
    throw new Error(`Could not resolve hostname "${hostname}": ${String(err)}`);
  }

  const isLoopback =
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("127.");

  if (!isLoopback) {
    throw new Error(
      `Refusing to run: "${hostname}" resolves to ${address}, which is not localhost. ` +
      `retrospecs only runs against 127.0.0.1 / ::1 / localhost.`
    );
  }
}