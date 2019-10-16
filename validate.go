package main

import (
	"fmt"
	"log"

	"github.com/spf13/cobra"

	"github.com/jkcfg/jk/pkg/std"
)

var validateCmd = &cobra.Command{
	Use:     "validate <file>...",
	Example: validateExamples,
	Short:   "Validate configuration files",
	Args:    validateArgs,
	Run:     validate,
}

const validateExamples = `
`

var validateOptions struct {
	vmOptions
	scriptOptions
}

func init() {
	initScriptFlags(validateCmd, &validateOptions.scriptOptions)
	initExecFlags(validateCmd, &validateOptions.vmOptions)
	jk.AddCommand(validateCmd)
}

func validateArgs(cmd *cobra.Command, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("validate requires a script and at least one file")
	}
	return nil
}

func validate(cmd *cobra.Command, args []string) {
	vm := newVM(&validateOptions.vmOptions)
	vm.SetWorkingDirectory(".")

	inputs := make(map[string]interface{})
	for _, f := range args[:1] {
		inputs[f] = f
	}
	vm.parameters.Set("jk.validate.input", inputs)

	var module string
	switch {
	case validateOptions.inline:
		module = fmt.Sprintf(string(std.Module("internal/validate-exec.js")), args[0])
	default:
		module = fmt.Sprintf(string(std.Module("internal/validate-module.js")), args[0])
	}
	if err := vm.Run("<validate>", module); err != nil {
		log.Fatal(err)
	}
}
