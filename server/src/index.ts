import { app } from "./app";
import { config } from "./config";

app.listen(config.port, () => {
  console.log(`TIPI API server listening on port ${config.port}`);
});
