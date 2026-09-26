#!/bin/sh
# Build a signed iOS .ipa from the command line, with no Xcode GUI sign-in.
#
# Authentication is an App Store Connect API key (a .p8 file), not an Apple ID:
# no password, no 2FA prompt, nothing interactive. xcodebuild uses it to create
# the signing certificate, the app ID and the provisioning profile on the
# developer portal by itself.
#
# Create the key once at appstoreconnect.apple.com -> Users and Access ->
# Integrations -> App Store Connect API -> Team Keys -> (+). Give it the
# App Manager role, or it won't be allowed to manage certificates. The .p8
# downloads exactly once.
#
# Usage:
#   ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_ABC123.p8 \
#   ASC_KEY_ID=ABC123 \
#   ASC_ISSUER_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee \
#   TEAM_ID=A1B2C3D4E5 \
#   METHOD=development \
#   API_URL=https://hrmsapi.4sightai.com \
#   sh scripts/ios-build.sh
#
# METHOD: development | ad-hoc | app-store | enterprise
#   development / ad-hoc install on specific iPhones, whose UDIDs must already
#   be registered on the portal (plug the phone in and add
#   -allowProvisioningDeviceRegistration to have xcodebuild do it).
#   app-store produces a build for TestFlight and needs no UDIDs, but the
#   bundle id must already exist in App Store Connect.
set -e
cd "$(dirname "$0")/.."

: "${ASC_KEY_PATH:?set ASC_KEY_PATH to the .p8 file}"
: "${ASC_KEY_ID:?set ASC_KEY_ID}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
: "${TEAM_ID:?set TEAM_ID (10 characters, from developer.apple.com -> Membership)}"
METHOD="${METHOD:-development}"
# Baked into the JS bundle at build time. Defaults to production, because a
# build that leaves this machine can't reach a local server.
API_URL="${API_URL:-https://hrmsapi.4sightai.com}"

OUT="${OUT:-$PWD/build/ios}"
ARCHIVE="$OUT/4SightHub.xcarchive"
mkdir -p "$OUT"

# Export options. team-id must match the certificate the key creates, or the
# export fails after the (slow) archive has already succeeded.
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>$METHOD</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
  <key>stripSwiftSymbols</key><true/>
  <key>compileBitcode</key><false/>
</dict>
</plist>
PLIST

AUTH="-authenticationKeyPath $ASC_KEY_PATH \
      -authenticationKeyID $ASC_KEY_ID \
      -authenticationKeyIssuerID $ASC_ISSUER_ID \
      -allowProvisioningUpdates"

echo "==> archiving ($METHOD, team $TEAM_ID, api $API_URL)"
EXPO_PUBLIC_API_URL="$API_URL" xcodebuild archive \
  -workspace ios/4SightHub.xcworkspace \
  -scheme 4SightHub \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  $AUTH

echo "==> exporting .ipa"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT" \
  $AUTH

echo
echo "done:"
ls -la "$OUT"/*.ipa
