import os, uvicorn

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        ws="none",
    )
