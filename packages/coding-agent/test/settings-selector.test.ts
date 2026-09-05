import { setKeybindings } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import {
	type SettingsCallbacks,
	type SettingsConfig,
	SettingsSelectorComponent,
} from "../src/modes/interactive/components/settings-selector.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";
import { createHarness, type Harness } from "./suite/harness.ts";

describe("SettingsSelectorComponent", () => {
	let harness: Harness | undefined;
	beforeAll(() => {
		initTheme("dark");
		setKeybindings(new KeybindingsManager());
	});

	afterEach(() => {
		harness?.cleanup();
		harness = undefined;
		vi.unstubAllEnvs();
	});

	it("shows built-in defaults independently of current values and environment overrides", () => {
		vi.stubEnv("PI_HARDWARE_CURSOR", "1");
		vi.stubEnv("PI_CLEAR_ON_SHRINK", "1");
		const onAutoCompactChange = vi.fn();
		const config = {
			autoCompact: false,
			editorPaddingX: 2,
			transport: "sse",
			steeringMode: "all",
			followUpMode: "all",
			mermaidRenderingMode: "off",
			defaultProjectTrust: "always",
			doubleEscapeAction: "fork",
			treeFilterMode: "all",
			tuiMode: "fullscreen",
			fullscreenExitOutput: "resume-hint",
			fullscreenScrollbar: "hidden",
			currentTheme: "light",
			showHardwareCursor: true,
			clearOnShrink: true,
			defaultModel: "not set",
			availableDefaultModels: [],
			modelThinkingLevels: {},
			warnings: {},
		} as unknown as SettingsConfig;
		const callbacks = { onAutoCompactChange } as unknown as SettingsCallbacks;
		const list = new SettingsSelectorComponent(config, callbacks).getSettingsList();

		const lines = list.render(100);
		const descriptionIndex = lines.findIndex((line) =>
			stripAnsi(line).includes("Automatically compact context when it gets too large"),
		);
		expect(descriptionIndex).toBeGreaterThanOrEqual(0);
		expect(stripAnsi(lines[descriptionIndex])).toBe(
			"  Automatically compact context when it gets too large (Default: true)",
		);
		expect(lines[descriptionIndex]).toContain(theme.fg("dim", "(Default: true)"));

		list.handleInput("\r");
		expect(onAutoCompactChange).toHaveBeenCalledWith(true);
		expect(list.render(100).join("\n")).toContain(theme.fg("dim", "(Default: true)"));

		for (const [id, value] of [
			["editor-padding", "0"],
			["output-padding", "1"],
			["autocomplete-max-visible", "5"],
			["transport", "auto"],
			["show-hardware-cursor", "false"],
			["clear-on-shrink", "false"],
			["default-project-trust", "Ask"],
			["model-thinking", "none"],
		]) {
			list.selectItem(id);
			expect(list.render(200).join("\n")).toContain(theme.fg("dim", `(Default: ${value})`));
		}

		list.selectItem("warnings");
		expect(stripAnsi(list.render(100).join("\n"))).not.toContain("Default:");
		list.handleInput("\r");
		expect(list.render(200).join("\n")).toContain(theme.fg("dim", "(Default: true)"));
	});

	it("cycles through fullscreen settings", () => {
		const onExitOutputChange = vi.fn();
		const onScrollbarChange = vi.fn();
		const onCopyOnSelectChange = vi.fn();
		const config = {
			fullscreenExitOutput: "transcript",
			fullscreenScrollbar: "auto",
			fullscreenCopyOnSelect: true,
			warnings: {},
			defaultModel: "not set",
			availableDefaultModels: [],
			availableThinkingLevels: [],
			modelThinkingLevels: {},
			availableThemes: [],
		} as unknown as SettingsConfig;
		const callbacks = {
			onFullscreenExitOutputChange: onExitOutputChange,
			onFullscreenScrollbarChange: onScrollbarChange,
			onFullscreenCopyOnSelectChange: onCopyOnSelectChange,
		} as unknown as SettingsCallbacks;

		const cycle = (label: string, count: number) => {
			const list = new SettingsSelectorComponent(config, callbacks).getSettingsList();
			for (const character of label) list.handleInput(character);
			for (let i = 0; i < count; i++) list.handleInput("\r");
		};

		cycle("Fullscreen exit output", 2);
		expect(onExitOutputChange.mock.calls.flat()).toEqual(["resume-hint", "transcript"]);
		cycle("Fullscreen scrollbar", 3);
		expect(onScrollbarChange.mock.calls.flat()).toEqual(["always", "hidden", "auto"]);
		cycle("Fullscreen copy on select", 2);
		expect(onCopyOnSelectChange.mock.calls.flat()).toEqual([false, true]);
	});

	it("keeps the configured fixed theme marked while browsing", () => {
		const config = {
			defaultModel: "not set",
			availableDefaultModels: [],
			modelThinkingLevels: {},
			currentTheme: "dark",
			terminalTheme: "dark",
			availableThemes: ["dark", "light"],
			warnings: {},
		} as unknown as SettingsConfig;
		const callbacks = { onThemePreview: vi.fn(), onCancel: () => {} } as unknown as SettingsCallbacks;
		const list = new SettingsSelectorComponent(config, callbacks).getSettingsList();

		list.selectItem("theme");
		list.handleInput("\r");
		let output = stripAnsi(list.render(120).join("\n"));
		expect(output).toContain("    Automatic");
		expect(output).toContain("→ ✓ dark");

		list.handleInput("\x1b[B");
		output = stripAnsi(list.render(120).join("\n"));
		expect(output).toContain("  ✓ dark");
		expect(output).toContain("→   light");
	});

	it("keeps a configured automatic theme marked while browsing", () => {
		const config = {
			defaultModel: "not set",
			availableDefaultModels: [],
			modelThinkingLevels: {},
			currentTheme: "light/dark",
			terminalTheme: "dark",
			availableThemes: ["dark", "light", "other"],
			warnings: {},
		} as unknown as SettingsConfig;
		const callbacks = { onThemePreview: vi.fn(), onCancel: () => {} } as unknown as SettingsCallbacks;
		const list = new SettingsSelectorComponent(config, callbacks).getSettingsList();

		list.selectItem("theme");
		list.handleInput("\r");
		list.handleInput("\r");
		let output = stripAnsi(list.render(120).join("\n"));
		expect(output).toContain("→ ✓ light");

		list.handleInput("\x1b[B");
		output = stripAnsi(list.render(120).join("\n"));
		expect(output).toContain("  ✓ light");
		expect(output).toContain("→   other");
	});

	it("keeps the configured per-model thinking level marked while browsing", async () => {
		harness = await createHarness({
			models: [{ id: "thinking-model", reasoning: true }],
		});
		const model = harness.getModel("thinking-model")!;
		const modelKey = `${model.provider}/${model.id}`;
		const config = {
			defaultModel: modelKey,
			availableDefaultModels: [model],
			thinkingLevel: "high",
			modelThinkingLevels: { [modelKey]: "medium" },
		} as unknown as SettingsConfig;
		const callbacks = { onCancel: () => {} } as unknown as SettingsCallbacks;
		const list = new SettingsSelectorComponent(config, callbacks).getSettingsList();

		list.selectItem("model-thinking");
		list.handleInput("\r");
		list.handleInput("\r");

		let output = stripAnsi(list.render(120).join("\n"));
		expect(output).toContain("→ ✓ medium");
		expect(output).toContain("    (clear override)");

		list.handleInput("\x1b[B");
		output = stripAnsi(list.render(120).join("\n"));
		expect(output).toContain("  ✓ medium");
		expect(output).toContain("→   high");
	});
});
