export interface JwtClaims {
	[key: string]: string | number | boolean | null;
}

export function issueJwt(claims: JwtClaims, secret: string, ttl: string | number): string;
export function verifyJwt(token: string, secret: string): JwtClaims | null;
