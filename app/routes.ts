import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("waiting", "routes/waiting.tsx"),
  route("game", "routes/game.tsx"),
  route("complete", "routes/complete.tsx"),
] satisfies RouteConfig;
