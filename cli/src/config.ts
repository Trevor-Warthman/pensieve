import Conf from "conf";

interface PensieveConfig {
  apiEndpoint?: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
  s3Bucket?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
}

const conf = new Conf<PensieveConfig>({ projectName: "pensieve" });

export const config = {
  get<K extends keyof PensieveConfig>(key: K): PensieveConfig[K] {
    return conf.get(key);
  },
  set<K extends keyof PensieveConfig>(key: K, value: PensieveConfig[K]): void {
    conf.set(key, value as string);
  },
  getAll(): PensieveConfig {
    return conf.store;
  },
  isAuthenticated(): boolean {
    return !!conf.get("accessToken");
  },
  delete<K extends keyof PensieveConfig>(key: K): void {
    conf.delete(key);
  },
  clear(): void {
    conf.clear();
  },
};
