/**
 * CommandLogger - A utility for executing and logging system commands.
 * 
 * This class centralizes command execution, providing consistent logging
 * to both the console and the Context DB.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ENTITY_TYPES } from '../../config/entity-schemas.js';

const execAsync = promisify(exec);

export class CommandLogger {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.domain = 'system'; // Use a dedicated domain for system-level metadata
  }

  /**
   * Executes a command, logs it, and persists the execution record.
   * @param {string} commandString - The command to execute.
   * @param {object} options - Execution options.
   * @returns {Promise<object>} - The stdout, stderr, and the persisted execution entity.
   */
  async execute(commandString, options = {}) {
    console.log(chalk.dim(`  ↳ Executing: ${commandString}`));

    const executionEntity = {
      name: `exec-${new Date().getTime()}`,
      type: ENTITY_TYPES.COMMAND_EXECUTION,
      domain: this.domain,
      command_string: commandString,
      timestamp: new Date().toISOString(),
      status: 'failure', // Default to failure
      output_summary: '',
      relationships: [],
    };

    try {
      const { stdout, stderr } = await execAsync(commandString, options.execOptions);

      executionEntity.status = 'success';
      if (stderr) {
        executionEntity.output_summary = `stderr: ${stderr.substring(0, 200)}...`;
      } else {
        executionEntity.output_summary = `stdout: ${stdout.substring(0, 200)}...`;
      }
      
      await this.persistEntity(executionEntity);
      return { stdout, stderr, execution: executionEntity };

    } catch (error) {
      executionEntity.output_summary = error.message;
      await this.persistEntity(executionEntity);
      // Re-throw the error so the calling function knows it failed
      throw error;
    }
  }

  /**
   * Persists an entity to the file-based context DB.
   * @param {object} entity - The entity to persist.
   */
  async persistEntity(entity) {
    try {
      const entityDir = path.join(this.dataPath, entity.domain, 'entities', entity.type);
      await fs.mkdir(entityDir, { recursive: true });

      const filename = `${entity.name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()}.json`;
      const filePath = path.join(entityDir, filename);

      await fs.writeFile(filePath, JSON.stringify(entity, null, 2));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to persist command execution entity ${entity.name}:`), error.message);
    }
  }
}
