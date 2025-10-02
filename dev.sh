#!/bin/bash

ENV=${1:-dev}
DEBUG=${2:-false}

# Set environment based on whether "prod" is in the ENV string
if [[ "$ENV" == *"prod"* ]]; then
    FIREBASE_PROJECT=prod
    NEXT_ENV=PROD
else
    FIREBASE_PROJECT=dev
    NEXT_ENV=DEV
fi

LOCAL_IP="localhost"

firebase use $FIREBASE_PROJECT

API_COMMAND="dev"
if [ "$DEBUG" = "true" ]; then
    API_COMMAND="debug"
fi

npx concurrently \
    -n API,NEXT,TS \
    -c white,magenta,cyan \
    "cross-env NEXT_PUBLIC_FIREBASE_ENV=${NEXT_ENV} \
                      yarn --cwd=backend/api $API_COMMAND" \
    "cross-env NEXT_PUBLIC_API_URL=${LOCAL_IP}:8088 \
              NEXT_PUBLIC_FIREBASE_ENV=${NEXT_ENV} \
              yarn --cwd=web serve" \
    "cross-env yarn --cwd=web ts-watch"