import * as std from '../index';
import * as param from '../param';
import { formatError, ValidationError } from '../schema';

// ValidateResult is the canonical type of results for a validation
// procedure.
type ValidateResult = 'ok' | string[];

// ValidateFnResult is the range of results we accept from an ad-hoc
// procedure given to us.
type ValidateFnResult = boolean | string | (string | ValidationError)[];
type ValidateFn = (obj: any) => ValidateFnResult | Promise<ValidateFnResult>;

function isValidationError(err: string | ValidationError): err is ValidationError {
  return (typeof err === 'object' && 'msg' in err);
};

function maybeFormatError(msg: string | ValidationError): string {
  if (isValidationError(msg)) {
    return formatError(msg);
  }
  return msg;
}

async function normaliseResult(val: Promise<ValidateFnResult>): Promise<ValidateResult> {
  const result = await val;
  switch (typeof result) {
  case 'string':
    if (result === 'ok') return result;
    return [result];
  case 'boolean':
    if (result) return 'ok';
    return ['value not valid'];
  case 'object':
    if (Array.isArray(result)) return result.map(maybeFormatError);
    break;
  default:
  }
  throw new Error(`unrecognised result from validation function: ${result}`);
}

interface FileResult {
  path: string;
  result: ValidateResult;
}

export default function validate(fn: ValidateFn): void {
  const inputFiles = param.Object('jk.validate.input', {});
  const files = Object.keys(inputFiles);

  const validateFile = async function vf(path: string): Promise<FileResult> {
    const obj = await std.read(path);
    const result = await normaliseResult(Promise.resolve(fn(obj)));
    return { path, result };
  };

  const objects = files.map(validateFile);
  Promise.all(objects).then((results): void => {
    for (const { path, result } of results) {
      if (result === 'ok') {
        std.log(`${path}: ok`);
      } else {
        std.log(`${path}:`);
        for (const err of result) {
          std.log(`  error: ${err}`);
        }
      }
    }
  });
}
