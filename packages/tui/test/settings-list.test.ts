import assert from "node:assert";
import { describe, it } from "node:test";
import { SettingsList, type SettingsListTheme } from "../src/components/settings-list.ts";
import { visibleWidth } from "../src/utils.ts";

const testTheme: SettingsListTheme = {
	label: (text) => text,
	value: (text) => text,
	description: (text) => text,
	cursor: "> ",
	hint: (text) => text,
};

const items = [
	{
		id: "tui-mode",
		label: "TUI mode",
		currentValue: "regular",
		values: ["regular", "fullscreen"],
	},
];

describe("SettingsList", () => {
	it("shows the selected default inline after the description using hint styling", () => {
		const list = new SettingsList(
			[
				{ ...items[0], description: "Interface layout", defaultValue: "regular" },
				{ id: "padding", label: "Padding", currentValue: "2", defaultValue: "0" },
				{ id: "action", label: "Action", currentValue: "configure" },
			],
			10,
			{ ...testTheme, hint: (text) => `\x1b[2m${text}\x1b[22m` },
			() => {},
			() => {},
		);

		const lines = list.render(80);
		assert.ok(lines.includes("  Interface layout \x1b[2m(Default: regular)\x1b[22m"));
		assert.ok(!lines[0].includes("Default:"));

		list.handleInput("\r");
		assert.ok(list.render(80).includes("  Interface layout \x1b[2m(Default: regular)\x1b[22m"));

		list.handleInput("\x1b[B");
		assert.ok(list.render(80).includes("  \x1b[2m(Default: 0)\x1b[22m"));

		list.selectItem("action");
		assert.ok(!list.render(80).join("\n").includes("Default:"));
	});

	it("wraps long default values within the available width", () => {
		const list = new SettingsList(
			[
				{
					id: "theme",
					label: "Theme",
					currentValue: "dark",
					description: "Color theme",
					defaultValue: "dark or light (detected from terminal)",
				},
			],
			10,
			testTheme,
			() => {},
			() => {},
		);

		const lines = list.render(24);
		assert.ok(lines.every((line) => visibleWidth(line) <= 24));
		assert.match(lines.join("\n"), /Default: dark or/);
		assert.match(lines.join("\n"), /terminal\)/);
	});

	it("includes spaces in an active search instead of changing the selected setting", () => {
		const changes: Array<{ id: string; value: string }> = [];
		const list = new SettingsList(
			items.map((item) => ({ ...item })),
			10,
			testTheme,
			(id, value) => changes.push({ id, value }),
			() => {},
			{ enableSearch: true },
		);

		for (const character of "TUI mode") list.handleInput(character);

		assert.deepStrictEqual(changes, []);
		assert.match(list.render(80)[0] ?? "", /TUI mode/);

		list.handleInput("\r");
		assert.deepStrictEqual(changes, [{ id: "tui-mode", value: "fullscreen" }]);
	});

	it("keeps Space as a change shortcut before a search query is entered", () => {
		const changes: Array<{ id: string; value: string }> = [];
		const list = new SettingsList(
			items.map((item) => ({ ...item })),
			10,
			testTheme,
			(id, value) => changes.push({ id, value }),
			() => {},
			{ enableSearch: true },
		);

		list.handleInput(" ");

		assert.deepStrictEqual(changes, [{ id: "tui-mode", value: "fullscreen" }]);
	});
});
