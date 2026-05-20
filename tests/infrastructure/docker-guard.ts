import Docker from 'dockerode';
export async function checkDocker() {
  try {
    await new Docker().version();
    return true;
  } catch {
    return false;
  }
}
