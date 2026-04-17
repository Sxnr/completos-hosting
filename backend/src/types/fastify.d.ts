// Extiende los tipos de Fastify para incluir nuestros decoradores
import '@fastify/jwt'
import type { JWTPayload } from './index'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

// Agrega el usuario decodificado del JWT a cada request
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTPayload
  }
}