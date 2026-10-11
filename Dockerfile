# FloodSense API on AWS Lambda. Lambda Web Adapter runs the same FastAPI app that runs locally.
FROM public.ecr.aws/docker/library/python:3.12-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/health \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    FLOODSENSE_STATE_DIR=/tmp/state

WORKDIR /var/task
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY data/processed data/processed
COPY backend/src backend/src

CMD ["python", "-m", "uvicorn", "floodsense.api:app", "--app-dir", "backend/src", "--host", "0.0.0.0", "--port", "8080"]
