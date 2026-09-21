import fs from "node:fs/promises";
import path from "node:path";
import * as yaml from "js-yaml";
import type { FuzzConfig, EndpointConfig, ParamConfig } from "../config/schema.js";

type OpenApiParameter = {
  name: string;
  in: string;
  schema?: {
    type?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
  };
};

type OpenApiOperation = {
  parameters?: OpenApiParameter[];
};

type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
};

function mapParamType(schemaType: string | undefined): "string" | "number" | "boolean" | null {
  switch (schemaType) {
    case "integer":
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    default:
      return null; // unsupported type — skip this param rather than guess
  }
}

export async function configFromOpenApi(
  specPath: string,
  baseUrl: string
): Promise<FuzzConfig> {
  const raw = await fs.readFile(specPath, "utf-8");
  const ext = path.extname(specPath).toLowerCase();
  const doc: OpenApiDocument =
    ext === ".json" ? JSON.parse(raw) : (yaml.load(raw) as OpenApiDocument);

  const endpoints: EndpointConfig[] = [];

  for (const [routePath, methods] of Object.entries(doc.paths)) {
    const getOp = methods.get ?? methods.GET;
    if (!getOp) continue; // MVP: only GET operations are supported

    const params: Record<string, ParamConfig> = {};
    for (const p of getOp.parameters ?? []) {
      if (p.in !== "query") continue; // MVP: only query params are supported
      const type = mapParamType(p.schema?.type);
      if (!type) continue;

      params[p.name] = {
        type,
        min: p.schema?.minimum ?? p.schema?.minLength,
        max: p.schema?.maximum ?? p.schema?.maxLength,
      };
    }

    endpoints.push({
      name: routePath.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+|_+$/g, ""),
      method: "GET",
      path: routePath,
      params,
      testCount: 150,
      allowMutations: false,
    });
  }

  return { baseUrl, endpoints };
}