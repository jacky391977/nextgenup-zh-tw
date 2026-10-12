"""A compiled-in hardware codec must not break video on Macs without a usable GPU."""
import ast
import subprocess
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

tree = ast.parse((Path(__file__).resolve().parents[1] / 'app.py').read_text(encoding='utf-8'))
function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_detect_encoder')
code = compile(ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[])), 'app.py', 'exec')


class EncoderTest(unittest.TestCase):
    def detect(self, platform, results):
        process = SimpleNamespace(run=Mock(side_effect=results), TimeoutExpired=subprocess.TimeoutExpired)
        context = {'subprocess': process, 'sys': SimpleNamespace(platform=platform), 'FFMPEG': 'ffmpeg'}
        exec(code, context)
        return context['_detect_encoder'](), process.run

    def test_advertised_but_unusable_hardware_falls_back(self):
        encoder, run = self.detect('darwin', [SimpleNamespace(stdout='h264_videotoolbox libx264'), SimpleNamespace(returncode=1)])
        self.assertEqual(encoder, 'libx264')
        self.assertIn('color=c=black:s=320x240:r=1', run.call_args.args[0])

    def test_usable_mac_hardware_keeps_acceleration(self):
        encoder, _ = self.detect('darwin', [SimpleNamespace(stdout='h264_videotoolbox libx264'), SimpleNamespace(returncode=0)])
        self.assertEqual(encoder, 'h264_videotoolbox')

    def test_hardware_probe_timeout_also_falls_back(self):
        encoder, _ = self.detect('darwin', [SimpleNamespace(stdout='h264_videotoolbox libx264'), subprocess.TimeoutExpired('ffmpeg', 10)])
        self.assertEqual(encoder, 'libx264')

    def test_windows_uses_cpu_encoder_without_mac_probe(self):
        encoder, run = self.detect('win32', [SimpleNamespace(stdout='h264_videotoolbox libx264')])
        self.assertEqual(encoder, 'libx264')
        self.assertEqual(run.call_count, 1)


if __name__ == '__main__':
    unittest.main()
