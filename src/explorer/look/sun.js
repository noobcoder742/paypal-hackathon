// Real sun position over Singapore (NOAA solar equations, accurate to well
// under a degree). The map is lit as at 6:20pm Singapore time on today's
// date: low warm sun from the west-southwest or west-northwest depending on
// the season, just before sunset (~7pm all year round).
const RAD = Math.PI / 180;

/** Sun azimuth (degrees clockwise from north) and elevation (degrees). */
export function sunPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5,
    T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * RAD);
  const eps =
    23 +
    (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 +
    0.00256 * Math.cos((125.04 - 1934.136 * T) * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarMin = (utcMin + eqTime + 4 * lon + 1440) % 1440;
  const H = (solarMin / 4 - 180) * RAD;
  const cosZ = Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(H);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const az =
    Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat * RAD) - Math.tan(decl) * Math.cos(lat * RAD)) / RAD +
    180;
  return { azimuth: (az + 360) % 360, elevation: 90 - zenith / RAD };
}

/** 6:20pm Singapore time (UTC+8, no daylight saving) on the given day. */
export function eveningInSingapore(day = new Date()) {
  const sg = new Date(day.getTime() + 8 * 3600000); // shift to read the SG calendar date
  return new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), sg.getUTCDate(), 18 - 8, 20));
}

/**
 * Unit vector pointing from the ground towards the sun in map space
 * (x = east, y = up, z = south).
 */
export function sunDirection(lat, lon, date = eveningInSingapore()) {
  const { azimuth, elevation } = sunPosition(date, lat, lon);
  const el = Math.max(4, elevation) * RAD,
    az = azimuth * RAD; // keep a sliver of light if the date puts the sun lower
  return {
    x: Math.sin(az) * Math.cos(el),
    y: Math.sin(el),
    z: -Math.cos(az) * Math.cos(el),
    azimuth,
    elevation,
  };
}
