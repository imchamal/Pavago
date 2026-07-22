import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "Tavago";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const messageButtonClass = "tavago_translate_message";
const tavagoIconClass = "fa-solid fa-crow";

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

function getMessageIdFromBlock(messageBlock) {
    const messageId = messageBlock?.getAttribute("mesid");
    const parsedId = Number(messageId);

    return Number.isInteger(parsedId) ? parsedId : null;
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
    button.addClass("tavago-busy");
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
        button.removeClass("tavago-busy");
        button.find("span").text("입력창 번역");
    }
}

async function translateChatMessage(messageBlock, button) {
    const context = getContext();
    const messageId = getMessageIdFromBlock(messageBlock);
    const message = messageId === null ? null : context.chat?.[messageId];

    if (!message || !message.mes) {
        showError("번역할 메시지를 찾지 못했습니다.");
        return;
    }

    button.prop("disabled", true);
    button.addClass("tavago-busy");

    try {
        const translatedText = await translateText(message.mes);
        message.extra = message.extra || {};
        message.extra.display_text = translatedText.trim();

        if (typeof context.updateMessageBlock === "function") {
            context.updateMessageBlock(messageId, message);
        }

        if (typeof context.saveChat === "function") {
            await context.saveChat();
        }

        showInfo("메시지 번역이 완료되었습니다.");
    } catch (error) {
        console.error(error);
        showError(error.message || "메시지 번역 중 오류가 발생했습니다.");
    } finally {
        button.prop("disabled", false);
        button.removeClass("tavago-busy");
        addTranslateButtonsToMessages();
    }
}

function findMessageButtonContainer(messageBlock) {
    return (
        messageBlock.querySelector(".extraMesButtons") ||
        messageBlock.querySelector(".mes_buttons") ||
        messageBlock
    );
}

function addTranslateButtonToMessage(messageBlock) {
    if (!(messageBlock instanceof HTMLElement)) {
        return;
    }

    if (messageBlock.querySelector(`.${messageButtonClass}`)) {
        return;
    }

    const messageId = getMessageIdFromBlock(messageBlock);

    if (messageId === null) {
        return;
    }

    const button = $(`
        <button class="${messageButtonClass} mes_button" title="Tavago로 이 메시지 번역">
            <i class="${tavagoIconClass}"></i>
        </button>
    `);

    button.on("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        await translateChatMessage(messageBlock, button);
    });

    findMessageButtonContainer(messageBlock).append(button[0]);
}

function addTranslateButtonsToMessages() {
    document.querySelectorAll("#chat .mes").forEach(addTranslateButtonToMessage);
}

function watchChatMessages() {
    const chat = document.querySelector("#chat");

    if (!chat) {
        return;
    }

    const observer = new MutationObserver(addTranslateButtonsToMessages);
    observer.observe(chat, { childList: true, subtree: true });
    addTranslateButtonsToMessages();
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
    watchChatMessages();
});
