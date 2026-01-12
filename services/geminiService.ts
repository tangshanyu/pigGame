import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateGameCommentary = async (score: number, maxScore: number): Promise<string> => {
  const ai = getGeminiClient();
  if (!ai) return "無法連接到 AI 評論員，但你玩得很棒！";

  try {
    const prompt = `
      你是一個幽默的農場運動會評論員。
      玩家剛剛玩完一個「小牛拿木槌打小豬」的遊戲 (打地鼠變體)。
      玩家得分: ${score}。
      最高可能得分約為: ${maxScore}。
      
      請用繁體中文給出一段簡短、有趣、稍微有點毒舌但友善的評語 (不超過 50 個字)。
      如果分數很高，誇獎小牛的力氣；如果分數很低，嘲笑小豬跑得比牛快。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "小牛累得說不出話來了！";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 評論員去放牛吃草了，暫時無法評論。";
  }
};
