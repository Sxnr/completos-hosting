import axios from 'axios';

const CF_API = 'https://api.cloudflare.com/client/v4';
const TOKEN  = process.env.CLOUDFLARE_TOKEN!;
const ZONE   = process.env.CLOUDFLARE_ZONE_ID!;
const DOMAIN = process.env.CLOUDFLARE_DOMAIN!;
const hdrs   = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// Mapa de puerto → hostname de playit
const PLAYIT_MAP: Record<number, string> = {
  25565: process.env.PLAYIT_25565 || '',
  25566: process.env.PLAYIT_25566 || '',
  25567: process.env.PLAYIT_25567 || '',
  25568: process.env.PLAYIT_25568 || '',
};

export function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32);
}

export function obtenerPlayitHost(puerto: number): string | null {
  return PLAYIT_MAP[puerto] || null;
}

export async function crearDNSServidor(slug: string, puerto: number): Promise<string | null> {
  const playitHost = obtenerPlayitHost(puerto);
  if (!playitHost) {
    console.error(`[CF] No hay tunnel de playit para puerto ${puerto}`);
    return null;
  }

  try {
    const res = await axios.post(`${CF_API}/zones/${ZONE}/dns_records`, {
      type: 'SRV',
      data: {
        service:  '_minecraft',
        proto:    '_tcp',
        name:     `${slug}.${DOMAIN}`,
        priority: 0,
        weight:   5,
        port:     puerto,
        target:   playitHost,
      },
      ttl: 1,
    }, { headers: hdrs });

    console.log(`[CF] ✅ ${slug}.${DOMAIN} → ${playitHost}:${puerto}`);
    return res.data.result.id;
  } catch (e: any) {
    console.error('[CF] ❌ Error:', e.response?.data?.errors || e.message);
    return null;
  }
}

export async function eliminarDNSServidor(recordId: string): Promise<void> {
  try {
    await axios.delete(`${CF_API}/zones/${ZONE}/dns_records/${recordId}`, { headers: hdrs });
    console.log(`[CF] 🗑 DNS eliminado: ${recordId}`);
  } catch (e: any) {
    console.error('[CF] ❌ Error al eliminar:', e.message);
  }
}