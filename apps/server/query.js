const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tc = await prisma.testCase.findFirst({
    where: { name: 'oraclefusioncloud' },
    include: { steps: { orderBy: { stepNumber: 'asc' } } }
  });
  console.log(tc.steps.map(s => ({ stepNumber: s.stepNumber, action: s.action, url: s.url })));
}
main().catch(console.error);
