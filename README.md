# Mix Run Tests

Quick commands to run your Elixir/Phoenix tests in VS Code.

## Features

* Toggle between program file and test file
* Run mix test for current program file or test file
* Run mix test for the nearest test block (current line)

## Keybindings

* **Toggle**: `alt+d` - Switch between source file (`*.ex`) and test file (`*_test.exs`)
* **Run test**: `alt+f` - Run all tests in the current file (or corresponding test file)
* **Run mix test for current line**: `alt+v` - Run the nearest test block containing the cursor

## Usage

### Toggle Between Files

When you're in a source file like `lib/my_app/user.ex`, press `alt+d` to jump to `test/my_app/user_test.exs`. Press `alt+d` again to go back.

### Run All Tests in File

Open a test file or source file and press `alt+f` to run all tests in that file (or its corresponding test file).

### Run Nearest Test

Position your cursor inside a test block and press `alt+v` to run just that test. The extension will find the nearest `test "description" do ... end` block and run it.

## Requirements

* VS Code 1.74.0 or higher
* Elixir project with Mix
* Test files following the `*_test.exs` naming convention

## Installation

1. Clone this repository
2. Run `npm install`
3. Press `F5` to open a new VS Code window with the extension loaded
4. Or package it with `vsce package` and install the `.vsix` file

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT

