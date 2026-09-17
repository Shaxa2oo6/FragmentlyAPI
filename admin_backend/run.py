import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    print(f"[STARTING] Admin Backend starting on http://localhost:{port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
