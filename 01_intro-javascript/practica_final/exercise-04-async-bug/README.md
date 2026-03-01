# Exercise 4: Fix Async Bug

## Objective

Understand why the original function returns `undefined` and fix it using both Promises and `async/await`.


## 4.1 – Why It Returns `undefined`

### 1) Identify the bug

The original function returns `user` before the `setTimeout` callback executes.  
Since `setTimeout` runs asynchronously, the function finishes execution immediately and `user` is still `undefined`.

### 2) Explain asynchronous behavior

`setTimeout` does not block the code.  
The callback is scheduled to run later, while the `return user;` statement runs right away.

That is why the function returns `undefined` instead of the expected user object.


## 4.2 – Fix Using Promises

### Approach

To fix the issue, the asynchronous logic is wrapped inside a `Promise`.  
Instead of returning the value directly, the function calls:

- `resolve()` when the user is found  
- `reject()` when the user does not exist  


### Fix Async Bug output:

![fix_async_bug_output.png](./images/fix_async_bug_output.png)

## Verification

To run the exercises:

- `node exercise4_asyncBug.js`
