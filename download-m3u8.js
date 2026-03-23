/*
 * @Author: Newcy4 newcy44@gmail.com
 * @Date: 2025-08-07 19:54:59
 * @LastEditors: Newcy4 newcy44@gmail.com
 * @LastEditTime: 2025-08-08 00:10:04
 * @FilePath: /testdownload/download-m3u8.js
 * @Description: 钉钉录播文件的 m3u8 下载脚本（针对闪记，具体可以看https://www.youtube.com/watch?v=ykDbFBDSQhU），m3u8每个片段30s
 *
 */
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// 配置项
// const BASE_URL = "https://dtliving-sh.dingtalk.com/live_hp/"; // 钉钉录播片段文件的URL前缀
// const BASE_URL = "https://dtliving-sz-dingpan.dingtalk.com/live/"; // 钉钉录播片段文件的URL前缀
const BASE_URL = "https://dtliving-sh-dingpan.dingtalk.com/live/"; // 钉钉录播片段文件的URL前缀
const DOWNLOAD_DELAY = 6; // 每个文件下载后等待的时间（秒），频率太快后面的片段会被返回403  目前最保险10s，最短6s，5s 的话会被封
const M3U8_FILE_PATH = "./demo.m3u8"; // 你本地的 m3u8 文件路径
const TS_OUTPUT_DIR = "./ts"; // 存放下载的 .ts 文件的目录
const OUTPUT_MP4_FILE = "./ts/output.mp4"; // 最终合并后的视频文件名

// 确保 ts 输出目录存在
fs.ensureDirSync(TS_OUTPUT_DIR);

// 读取 m3u8 文件内容
const m3u8Content = fs.readFileSync(M3U8_FILE_PATH, "utf8");

// 按行分割
const lines = m3u8Content.split("\n");

// 用于存放所有 .ts 文件的下载 URL 和本地文件名
const tsFiles = [];

// 解析 m3u8，提取 .ts 文件的 URL
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  // if (line && !line.startsWith('#') && line.startsWith('https')) {
  if (line && !line.startsWith("#") && line.includes("ts?auth_key=")) {
    tsFiles.push(BASE_URL + line);
  }
}

console.log(`✅ 找到 ${tsFiles.length} 个 .ts 文件，开始下载...`);

// 下载所有 .ts 文件
(async () => {
  // 使用 for...of 循环，每次下载一个 ts 文件后等待 10 秒
  for (let i = 0; i < tsFiles.length; i++) {
    const tsUrl = tsFiles[i];
    const tsFileName = `${i + 1}.ts`; // 如 1.ts, 2.ts...
    const tsFilePath = path.join(TS_OUTPUT_DIR, tsFileName);

    console.log(`⬇️  正在下载第 ${i + 1}/${tsFiles.length} 个文件: ${tsUrl}`);

    try {
      const response = await axios({
        method: "get",
        url: tsUrl,
        responseType: "stream",
      });

      const writer = fs.createWriteStream(tsFilePath);

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`✅ 下载完成: ${tsFilePath}`);

      // 🔁 如果不是最后一个文件，则等待 10 秒
      if (i < tsFiles.length - 1) {
        console.log(`⏳ 等待 ${DOWNLOAD_DELAY} 秒后继续下载下一个文件...`);
        await new Promise((resolve) =>
          setTimeout(resolve, DOWNLOAD_DELAY * 1000),
        ); // 等待 DOWNLOAD_DELAY 秒
      }
    } catch (error) {
      console.error(`❌ 下载失败 [${i + 1}]: ${tsUrl} -`, error.message);
      throw new Error(`下载失败: ${tsUrl} - ${error.message}`);
      // 出错后，也可以选择继续等待 10 秒再下一个（可选）
      // if (i < tsFiles.length - 1) {
      //   console.log(`⏳ 等待 ${DOWNLOAD_DELAY} 秒后重试下一个文件...`);
      //   await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY * 1000));
      // }
    }
  }

  // 所有 ts 下载完成后，尝试合并
  console.log("\n🎬 所有 .ts 文件下载完成，开始合并为 MP4...");

  try {
    // 方法：使用 ffmpeg 合并（推荐，高效且简单）
    // 如果你安装了 ffmpeg，可以用下面这一行命令合并所有 ts 文件
    const { execSync } = require("child_process");
    const tsFilesList = tsFiles
      // .map((_, i) => path.join(TS_OUTPUT_DIR, `${i + 1}.ts`))
      .map((_, i) => path.join(TS_OUTPUT_DIR, `${i + 1}.ts`))
      .join(" ");

    // 注意：以下命令需要系统已安装 ffmpeg，并且在 PATH 中可用
    console.log(`🔧 使用 ffmpeg 合并 .ts 文件，请确保已安装 ffmpeg`);

    // 创建文件列表
    const listFilePath = path.join(TS_OUTPUT_DIR, "filelist.txt");
    const fileListContent = tsFiles
      // .map((_, i) => `file '${path.join(TS_OUTPUT_DIR, `${i + 1}.ts`)}'`)
      .map((_, i) => `file ${i + 1}.ts`)
      .join("\n");

    fs.writeFileSync(listFilePath, fileListContent);

    // 执行 ffmpeg 命令：通过 filelist 合并(前提是电脑已经装了 ffmpeg)
    execSync(
      `ffmpeg -f concat -safe 0 -i ./${listFilePath} -c copy ${OUTPUT_MP4_FILE}`,
      { stdio: "inherit" }, // 显示 ffmpeg 输出
    );

    console.log(`🎉 合并完成！视频已保存为: ${OUTPUT_MP4_FILE}`);
  } catch (ffmpegError) {
    console.error(
      "❌ ffmpeg 合并失败，可能未安装 ffmpeg 或出错:",
      ffmpegError.message,
    );
    console.log(
      "📦 你可以手动用工具（如 MKVToolNix / FFmpeg）将 ts 文件合并为 MP4",
    );
  }
})();
