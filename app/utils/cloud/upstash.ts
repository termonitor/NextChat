import { STORAGE_KEY } from "@/app/constant";
import { SyncStore } from "@/app/store/sync";
import { chunks } from "../format";

export type UpstashConfig = SyncStore["upstash"];
export type UpStashClient = ReturnType<typeof createUpstashClient>;

// 定义一个辅助函数，用于延迟指定的毫秒数
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createUpstashClient(store: SyncStore) {
  const config = store.upstash;
  const storeKey = config.username.length === 0 ? STORAGE_KEY : config.username;
  const chunkCountKey = `${storeKey}-chunk-count`;
  const chunkIndexKey = (i: number) => `${storeKey}-chunk-${i}`;

  const proxyUrl =
    store.useProxy && store.proxyUrl.length > 0 ? store.proxyUrl : undefined;

  return {
    async check() {
      try {
        const res = await fetch(this.path(`get/${storeKey}`, proxyUrl), {
          method: "GET",
          headers: this.headers(),
        });
        console.log("[Upstash] check", res.status, res.statusText);
        return [200].includes(res.status);
      } catch (e) {
        console.error("[Upstash] failed to check", e);
      }
      return false;
    },

    async redisGet(key: string) {
      const res = await fetch(this.path(`get/${key}`, proxyUrl), {
        method: "GET",
        headers: this.headers(),
      });

      console.log("[Upstash] get key = ", key, res.status, res.statusText);
      const resJson = (await res.json()) as { result: string };

      return resJson.result;
    },

    async redisSet(key: string, value: string) {
      const res = await fetch(this.path(`set/${key}`, proxyUrl), {
        method: "POST",
        headers: this.headers(),
        body: value,
      });

      console.log("[Upstash] set key = ", key, res.status, res.statusText);
    },

    async get() {
      const chunkCount = Number(await this.redisGet(chunkCountKey));
      if (!Number.isInteger(chunkCount)) return;

      const chunks = await Promise.all(
        new Array(chunkCount)
          .fill(0)
          .map((_, i) => this.redisGet(chunkIndexKey(i))),
      );
      console.log("[Upstash] get full chunks", chunks);
      return chunks.join("");
    },

    async set(_: string, value: string) {
      // upstash limit the max request size which is 1Mb for “Free” and “Pay as you go”
      // so we need to split the data to chunks
      let index = 0;
      for await (const chunk of chunks(value)) {
        await this.redisSet(chunkIndexKey(index), chunk);
        // wait 2 second
        await delay(2000);
        index += 1;
      }
      await this.redisSet(chunkCountKey, index.toString());
    },

    async fix_part(_: string, value: string) {
      const chunkCount = Number(await this.redisGet(chunkCountKey));
      if (!Number.isInteger(chunkCount)) return;

      const chunks = await Promise.all(
        new Array(chunkCount)
          .fill(0)
          .map((_, i) => this.redisGet(chunkIndexKey(i))),
      );

      // 检查 chunks 数组中是否有 null 元素，并记录其下标
      const nullIndices: number[] = [];
      chunks.forEach((chunk, index) => {
          if (chunk === null) {
              nullIndices.push(index);
          }
      });
      
      // 输出 null 元素的下标
      if (nullIndices.length > 0) {
          console.log("Chunks 中 null 元素的下标：", nullIndices);
          let part_index = nullIndices[0];
          // 重推该下标对应的数据
          let index = 0;
          for await (const chunk of chunks(value)) {
            if (index === part_index) {
                // 重推该下标对应的数据
                await this.redisSet(chunkIndexKey(index), chunk);
            }
            index++;
          }
      }
    },

    headers() {
      return {
        Authorization: `Bearer ${config.apiKey}`,
      };
    },
    path(path: string, proxyUrl: string = "") {
      if (!path.endsWith("/")) {
        path += "/";
      }
      if (path.startsWith("/")) {
        path = path.slice(1);
      }

      if (proxyUrl.length > 0 && !proxyUrl.endsWith("/")) {
        proxyUrl += "/";
      }

      let url;
      const pathPrefix = "/api/upstash/";

      try {
        let u = new URL(proxyUrl + pathPrefix + path);
        // add query params
        u.searchParams.append("endpoint", config.endpoint);
        url = u.toString();
      } catch (e) {
        url = pathPrefix + path + "?endpoint=" + config.endpoint;
      }

      return url;
    },
  };
}
