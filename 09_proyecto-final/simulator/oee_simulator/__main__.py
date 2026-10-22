import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "oee_simulator.main:app",
        host=os.getenv("SIMULATOR_HTTP_HOST", "0.0.0.0"),
        port=int(os.getenv("SIMULATOR_HTTP_PORT", "8100")),
    )
