import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/antt-ciot.service.test.ts",
      "tests/ciot-xml.test.ts",
      "tests/ciot-runtime.test.ts",
    ],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
