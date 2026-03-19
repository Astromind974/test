/**
 * tests/ssrf.test.js
 * ------------------
 * Tests unitaires pour l'utilitaire de protection SSRF.
 */

const { isPrivateIP } = require("../src/utils/ssrf");

describe("isPrivateIP", () => {
  // Adresses privées — doivent retourner true
  test("classe C privée (192.168.x.x)", () => {
    expect(isPrivateIP("192.168.1.1")).toBe(true);
  });

  test("classe A privée (10.x.x.x)", () => {
    expect(isPrivateIP("10.0.0.1")).toBe(true);
  });

  test("classe B privée (172.16-31.x.x)", () => {
    expect(isPrivateIP("172.16.0.1")).toBe(true);
    expect(isPrivateIP("172.31.255.255")).toBe(true);
  });

  test("loopback (127.x.x.x)", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(true);
  });

  test("link-local (169.254.x.x)", () => {
    expect(isPrivateIP("169.254.169.254")).toBe(true);
  });

  test("multicast (224.x.x.x)", () => {
    expect(isPrivateIP("224.0.0.1")).toBe(true);
  });

  // Adresses publiques — doivent retourner false
  test("adresse publique (8.8.8.8)", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false);
  });

  test("adresse publique (1.1.1.1)", () => {
    expect(isPrivateIP("1.1.1.1")).toBe(false);
  });
});
