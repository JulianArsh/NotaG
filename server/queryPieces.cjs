const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.piece.findMany({ select: { id: true, title: true, composer: true } })
  .then(r => { console.log(JSON.stringify(r, null, 2)); return p.$disconnect(); })
  .catch(e => { console.error(e); return p.$disconnect(); });
