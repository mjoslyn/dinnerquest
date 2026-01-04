import type { Config } from "@react-router/dev/config";

export default {
  // Use SPA mode - all state is in URL params, no server needed
  ssr: false,
} satisfies Config;
