/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/
import { assert } from "@esm-bundle/chai";
export function assert_deep_partial(actual, expected, assertfn = assert.deepEqual, path = "actual") {
    for (const [key, value] of Object.entries(expected)) {
        const local_path = `${path}.${key}`;
        const actual_value = actual[key];
        if (actual_value == null && value != null) {
            assertfn(actual_value, value, `Expected ${local_path} to be ${value} found ${actual_value}`);
        }
        switch (typeof value) {
            case "object":
                assert_deep_partial(actual[key], value, assertfn, local_path);
                break;
            default:
                assertfn(actual[key], value, `Expected ${local_path} to be ${value} found ${actual[key]}`);
        }
    }
}
