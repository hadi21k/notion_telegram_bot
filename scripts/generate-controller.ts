import fs from "fs";
import path from "path";

interface ControllerOptions {
  name: string;
  route: string;
  methods?: string[];
}

// Convert kebab-case or snake_case to PascalCase
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/g)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

// Convert kebab-case or snake_case to camelCase
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

const CONTROLLER_HEADER = `import { Request, Response } from 'express';

export class {{className}} {
  private static readonly route = '{{route}}';
`;
const CONTROLLER_METHOD = `
  static async {{method}}(req: Request, res: Response): Promise<void> {
    try {
      // Your implementation here
      res.status(200).json({ message: '{{method}} endpoint working' });
    } catch (error) {
      console.error('Error in {{method}}:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
`;
const CONTROLLER_FOOTER = `}
`;

const ROUTE_TEMPLATE = `import { Router } from 'express';
import { {{className}} } from '../controllers/{{name}}.controller';

const router = Router();

{{routes}}

export default router;
`;

function generateController(options: ControllerOptions): void {
  const { name, route, methods = ["get", "post", "put", "delete"] } = options;
  const camelName = toCamelCase(name);
  const className = toPascalCase(name) + "Controller";
  const controllerPath = path.join(
    process.cwd(),
    "src",
    "controllers",
    `${name}.controller.ts`
  );
  const routePath = path.join(
    process.cwd(),
    "src",
    "routes",
    `${name}.routes.ts`
  );

  // Ensure directories exist
  [path.dirname(controllerPath), path.dirname(routePath)].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Build controller content
  const methodsCode = methods
    .map((m) => CONTROLLER_METHOD.replace(/{{method}}/g, m))
    .join("");
  const controllerContent =
    CONTROLLER_HEADER.replace(/{{className}}/g, className).replace(
      /{{route}}/g,
      route
    ) +
    methodsCode +
    CONTROLLER_FOOTER;
  fs.writeFileSync(controllerPath, controllerContent);

  // Build route file
  const routeMethods = methods
    .map((m) => `router.${m}('/', ${className}.${m});`)
    .join("\n");
  const routeContent = ROUTE_TEMPLATE.replace(/{{className}}/g, className)
    .replace(/{{name}}/g, name)
    .replace(/{{routes}}/g, routeMethods + "\n");
  fs.writeFileSync(routePath, routeContent);

  // Update main index routes
  const mainRoutesPath = path.join(process.cwd(), "src", "routes", "index.ts");
  const importLine = `import ${camelName}Routes from './${name}.routes';`;
  const useLine = `router.use('${route}', ${camelName}Routes);`;

  if (!fs.existsSync(mainRoutesPath)) {
    fs.writeFileSync(
      mainRoutesPath,
      `import { Router } from 'express';\n\nconst router = Router();\n\nexport default router;`
    );
  }

  let mainContent = fs.readFileSync(mainRoutesPath, "utf8");
  if (!mainContent.includes(importLine)) {
    mainContent = importLine + "\n" + mainContent;
  }
  if (!mainContent.includes(useLine)) {
    mainContent = mainContent.replace(
      /export default router;/,
      `  ${useLine}\n\nexport default router;`
    );
  }
  fs.writeFileSync(mainRoutesPath, mainContent);

  console.info(`✅ Controller ${className} generated successfully!`);
  console.info(`📁 Controller: ${controllerPath}`);
  console.info(`📁 Routes: ${routePath}`);
  console.info(`🛣️ Base Route: ${route}`);
  console.info(`🔄 Methods: ${methods.join(", ")}`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: npm run generate:controller <name> <route> [methods]");
  console.error(
    "Example: npm run generate:controller user /api/users get,post,put,delete"
  );
  process.exit(1);
}
const [name, route, methodsStr] = args;
const methods = methodsStr ? methodsStr.split(",") : undefined;

generateController({ name, route, methods });
