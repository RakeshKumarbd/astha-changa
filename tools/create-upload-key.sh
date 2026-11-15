#!/bin/bash
# Creates the Google Play upload key and android/keystore.properties.
# The password is typed by you and never shown or printed.
set -euo pipefail

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE="$HOME/keys/astha-changa-upload.jks"
PROPS="$PROJECT/android/keystore.properties"
KEYTOOL="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"

if [ -f "$KEYSTORE" ]; then
  echo "An upload key already exists at $KEYSTORE. Not overwriting it."
  exit 1
fi

echo "Create a password for your Google Play upload key (at least 8 characters)."
echo "Keep it safe: every future update of the app needs this same key and password."
while true; do
  read -r -s -p "Password: " P1; echo
  read -r -s -p "Same password again: " P2; echo
  if [ "$P1" != "$P2" ]; then echo "They don't match. Try again."; continue; fi
  if [ "${#P1}" -lt 8 ]; then echo "Too short. Use at least 8 characters."; continue; fi
  break
done

mkdir -p "$HOME/keys"
chmod 700 "$HOME/keys"
export ASTHA_KEY_PASS="$P1"
"$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Rakesh Prajapat, O=Astha Changa, C=IN" \
  -storepass:env ASTHA_KEY_PASS -keypass:env ASTHA_KEY_PASS >/dev/null
chmod 600 "$KEYSTORE"

umask 077
cat > "$PROPS" <<EOF
storeFile=$KEYSTORE
storePassword=$P1
keyAlias=upload
keyPassword=$P1
EOF
unset P1 P2 ASTHA_KEY_PASS

echo
echo "Done. Upload key: $KEYSTORE"
echo "Settings: $PROPS (git-ignored)"
echo "IMPORTANT: back up $KEYSTORE and your password somewhere safe (e.g. a password manager)."
