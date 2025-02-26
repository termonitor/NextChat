export function prettyObject(msg: any) {
  const obj = msg;
  if (typeof msg !== "string") {
    msg = JSON.stringify(msg, null, "  ");
  }
  if (msg === "{}") {
    return obj.toString();
  }
  if (msg.startsWith("```json")) {
    return msg;
  }
  return ["```json", msg, "```"].join("\n");
}

export function* chunks(s: string, maxBytes = 1000 * 1000) {
  // const decoder = new TextDecoder("utf-8");
  // let buf = new TextEncoder().encode(s);
  // while (buf.length) {
  //   let i = buf.lastIndexOf(32, maxBytes + 1);
  //   // If no space found, try forward search
  //   if (i < 0) i = buf.indexOf(32, maxBytes);
  //   // If there's no space at all, take all
  //   if (i < 0) i = buf.length;
  //   // This is a safe cut-off point; never half-way a multi-byte
  //   yield decoder.decode(buf.slice(0, i));
  //   buf = buf.slice(i + 1); // Skip space (if any)
  // }

  const decoder = new TextDecoder("utf-8");
  let buf = new TextEncoder().encode(s);
  while (buf.length) {
      let i = buf.lastIndexOf(32, maxBytes + 1);
      // If no space found, try forward search
      if (i < 0) {
          i = buf.indexOf(32, maxBytes);
      }
      // If still no space found, split at maxBytes while ensuring valid UTF - 8
      if (i < 0) {
          i = maxBytes;
          // Move the index back to ensure it's not in the middle of a multi - byte character
          while (i > 0 && (buf[i] & 0xC0) === 0x80) {
              i--;
          }
      }
      // This is a safe cut - off point; never half - way a multi - byte
      // yield decoder.decode(buf.slice(0, i));
      // buf = buf.slice(i+1); // Skip space (if any)
      // 生成当前块，这里包含分割点字符
      yield decoder.decode(buf.slice(0, i + (i < buf.length? 1 : 0)));
      // 更新剩余的缓冲区
      buf = buf.slice(i + (i < buf.length? 1 : 0));
  }
}
