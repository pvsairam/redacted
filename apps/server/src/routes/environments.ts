import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const router = Router();

const mapEnvironment = (env: any) => {
  let vars = [];
  try {
    vars = JSON.parse(env.variables);
  } catch {}
  return {
    ...env,
    variables: vars.map((v: any) => ({
      ...v,
      value: v.isSecret ? '[HIDDEN]' : v.value,
    })),
  };
};

// GET all environments
router.get('/', async (_req, res) => {
  try {
    const envs = await prisma.environment.findMany({
      orderBy: { name: 'asc' },
    });
    return res.json({
      success: true,
      data: envs.map(mapEnvironment),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET single environment
router.get('/:id', async (req, res) => {
  try {
    const env = await prisma.environment.findUnique({
      where: { id: req.params.id },
    });
    if (!env) return res.status(404).json({ error: 'Not found' });
    
    return res.json({
      success: true,
      data: mapEnvironment(env),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST create environment
router.post('/', async (req, res) => {
  try {
    const { name, baseUrl, variables } = req.body;
    
    // Encrypt the variables before saving
    let encryptedVars = '[]';
    if (variables && Array.isArray(variables)) {
      const encrypted = variables.map((v: any) => ({
        key: v.key,
        value: v.isSecret ? encrypt(v.value) : v.value,
        isSecret: v.isSecret,
      }));
      encryptedVars = JSON.stringify(encrypted);
    }

    const env = await prisma.environment.create({
      data: {
        name,
        baseUrl,
        variables: encryptedVars,
      },
    });

    return res.json({
      success: true,
      data: mapEnvironment(env),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// PUT update environment
router.put('/:id', async (req, res) => {
  try {
    const { name, baseUrl, variables } = req.body;
    
    const existing = await prisma.environment.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // Only encrypt if new variables were provided
    let newEncryptedVars: string | undefined;
    if (variables && Array.isArray(variables)) {
      const encrypted = variables.map((v: any) => ({
        key: v.key,
        value: v.isSecret && v.value !== '[HIDDEN]' ? encrypt(v.value) : v.value,
        isSecret: v.isSecret,
      }));
      newEncryptedVars = JSON.stringify(encrypted);
    }

    const env = await prisma.environment.update({
      where: { id: req.params.id },
      data: {
        name,
        baseUrl,
        ...(newEncryptedVars ? { variables: newEncryptedVars } : {}),
      },
    });
    return res.json(env);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE environment
router.delete('/:id', async (req, res) => {
  try {
    await prisma.environment.delete({
      where: { id: req.params.id },
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Helper to decrypt variables for the engine (NOT exported via HTTP directly for security)
export async function getDecryptedEnvironmentVariables(environmentId: string): Promise<Record<string, string>> {
  const env = await prisma.environment.findUnique({
    where: { id: environmentId },
  });
  if (!env) return {};
  
  const decrypted: Record<string, string> = {};
  try {
    const vars = JSON.parse(env.variables);
    if (Array.isArray(vars)) {
      for (const v of vars) {
        if (v.key) {
          decrypted[v.key] = v.isSecret ? decrypt(String(v.value)) : String(v.value);
        }
      }
    } else {
      // Fallback for older object format
      for (const [key, val] of Object.entries(vars)) {
        decrypted[key] = decrypt(String(val));
      }
    }
  } catch (e) {
    console.error('Failed to decrypt environment variables', e);
  }
  return decrypted;
}

export { router as environmentsRouter };
