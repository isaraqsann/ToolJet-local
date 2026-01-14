FROM tooljet/try:ee-lts-latest

# copy fcm-bridge.html dan Firebase lokal ke folder build assets
COPY fcm-bridge.html /app/frontend/build/assets/fcm-bridge.html
COPY fcm-bridge.js /app/frontend/build/assets/fcm-bridge.js
# Copy SW ke folder build assets
COPY firebase-messaging-sw.js /app/frontend/build/assets/firebase-messaging-sw.js

COPY bootstrap.helper.js /app/server/dist/src/helpers/bootstrap.helper.js
