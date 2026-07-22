import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "Tavago";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    targetLanguage: "Korean",
    systemPrompt: [
        "You are Tavago, a precise translation engine.",
        "Translate the user's text into {{language}}.",
        "Preserve names, markdown, code blocks, and roleplay formatting.",
        "Return only the translated text.",
    ].join("\n"),
};

function getSettings() {
    extension_settings[extensionName] = Object.assign(
        {},
        defaultSettings,
        extension_settings[extensionName] || {},
    );

    return extension_settings[extensionName];
}

function showInfo(message) {
    if (typeof toastr !== "undefined") {
        toastr.info(message, extensionName);
    } else {
        console.info(`[${extensionName}] ${message}`);
    }
}

function showError(message) {
    if (typeof toastr !== "undefined") {
        toastr.error(message, extensionName);
    } else {
        console.error(`[${extensionName}] ${message}`);
    }
}

function getInputTextarea() {
    return document.querySelector("#send_textarea");
}

async function translateText(text) {
    const context = getContext();

    if (typeof context.generateRaw !== "function") {
        throw new Error("현재 SillyTavern에서 generateRaw()를 찾을 수 없습니다.");
    }

    const settings = getSettings();
    const systemPrompt = settings.systemPrompt.replaceAll("{{language}}", settings.targetLanguage);

    return await context.generateRaw({
        systemPrompt,
        prompt: text,
    });
}

async function translateInputTextarea() {
    const textarea = getInputTextarea();

    if (!(textarea instanceof HTMLTextAreaElement)) {
        showError("입력창을 찾지 못했습니다.");
        return;
    }

    const originalText = textarea.value.trim();

    if (!originalText) {
        showInfo("번역할 입력창 내용이 없습니다.");
        return;
    }

    const button = $("#tavago_translate_input");
    button.prop("disabled", true);
    button.find("span").text("번역 중...");

    try {
        const translatedText = await translateText(originalText);
        textarea.value = translatedText.trim();
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        showInfo("입력창 번역이 완료되었습니다.");
    } catch (error) {
        console.error(error);
        showError(error.message || "번역 중 오류가 발생했습니다.");
    } finally {
        button.prop("disabled", false);
        button.find("span").text("입력창 번역");
    }
}

function loadSettingsToUi() {
    const settings = getSettings();
    $("#tavago_target_language").val(settings.targetLanguage);
    $("#tavago_system_prompt").val(settings.systemPrompt);
}

function bindSettingsEvents() {
    $("#tavago_target_language").on("input", function () {
        getSettings().targetLanguage = String($(this).val() || "Korean").trim() || "Korean";
        saveSettingsDebounced();
    });

    $("#tavago_system_prompt").on("input", function () {
        getSettings().systemPrompt = String($(this).val() || defaultSettings.systemPrompt);
        saveSettingsDebounced();
    });

    $("#tavago_translate_input").on("click", translateInputTextarea);
}

jQuery(async () => {
    getSettings();

    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings").append(settingsHtml);

    loadSettingsToUi();
    bindSettingsEvents();
});
