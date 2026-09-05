import { useQuery } from '@tanstack/react-query';
import { portalApi } from '@/api/endpoints/portal';
import { queryKeys } from '@/api/queryKeys';

const FORBIDDEN_KEY_PATTERN = /(cost|margin|risk|ceiling|overage|approval|approver)/i;

function assertPortalPayloadSecurity(obj: any, path = ''): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item, idx) => assertPortalPayloadSecurity(item, `${path}[${idx}]`));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      if (import.meta.env.DEV) {
        console.error(`[PORTAL SECURITY BREACH DETECTED]: Forbidden key "${key}" found at path "${path}.${key}". Stripping from customer portal state.`);
      }
      continue;
    }
    sanitized[key] = assertPortalPayloadSecurity(value, path ? `${path}.${key}` : key);
  }
  return sanitized;
}

export function usePortalDeal(dealId: string) {
  return useQuery({
    queryKey: queryKeys.portal.deal(dealId),
    queryFn: async () => {
      const raw = await portalApi.getDeal(dealId);
      return assertPortalPayloadSecurity(raw);
    },
  });
}
