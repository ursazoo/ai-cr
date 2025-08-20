// 测试文件 - 用于验证智能上下文扩展器
export interface TestInterface {
  id: string;
  name: string;
}

export function testFunction(param: TestInterface): string {
  // 修改：移除了console.log，添加了参数验证
  if (!param || !param.name) {
    throw new Error('Invalid parameter');
  }
  return `Hello, ${param.name}!`;
}

export class TestClass {
  private value: string;

  constructor(value: string) {
    this.value = value;
  }

  public getValue(): string {
    return this.value;
  }
}